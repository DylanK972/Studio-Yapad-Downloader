// Studio Yapad Downloader v6.3 — Fix Instagram Universal + RapidAPI fallback
// by Dylan KESSLER / Studio Yapad

import { serveFile } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname } from "https://deno.land/std@0.224.0/path/mod.ts";

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

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const link = url.searchParams.get("url");
  if (link) {
    try {
      let result;

      // 🟣 INSTAGRAM UNIVERSAL
      if (link.includes("instagram.com")) {
        try {
          // Essai via RapidAPI
          const res = await fetch(
            `https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/?url=${encodeURIComponent(
              link
            )}`,
            {
              headers: {
                "x-rapidapi-key": RAPID_KEY,
                "x-rapidapi-host":
                  "instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com",
              },
            }
          );
          const data = await res.json();

          if (data.media && data.media.length > 0) {
            result = {
              platform: "instagram",
              media: data.media.map((m) => m.url || m),
              caption: data.caption || "",
              author: data.username || "inconnu",
              source: "RapidAPI",
              timestamp: Date.now(),
            };
          } else {
            throw new Error("No media from RapidAPI");
          }
        } catch {
          // 🔁 Fallback via Snapinsta.io (form scraping JSON)
          const api = "https://snapinsta.io/api/ajaxSearch";
          const body = new URLSearchParams({ q: link, t: "media" });
          const fallbackRes = await fetch(api, {
            method: "POST",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded; charset=UTF-8",
            },
            body,
          });
          const fbData = await fallbackRes.json();
          const html = fbData.data || "";
          const matches = [...html.matchAll(/href="([^"]+\.(mp4|jpg))"/g)];
          const media = matches.map((m) => m[1]);
          if (media.length === 0) throw new Error("Aucun média trouvé.");

          result = {
            platform: "instagram",
            media,
            source: "Snapinsta fallback",
            timestamp: Date.now(),
          };
        }
      }

      // 🔴 TIKTOK
      else if (link.includes("tiktok.com")) {
        const res = await fetch(
          `https://tiktok-download-video-no-watermark.p.rapidapi.com/tiktok/info?url=${encodeURIComponent(
            link
          )}`,
          {
            headers: {
              "x-rapidapi-key": RAPID_KEY,
              "x-rapidapi-host":
                "tiktok-download-video-no-watermark.p.rapidapi.com",
            },
          }
        );
        const data = await res.json();

        if (!data.data || !data.data.video_link_nwm_hd)
          throw new Error("Aucun média TikTok trouvé.");

        result = {
          platform: "tiktok",
          caption: data.data.desc,
          author: data.data.author_nickname,
          avatar: data.data.author_avatar,
          cover: data.data.cover,
          music: data.data.music?.uri,
          media: [data.data.video_link_nwm_hd],
          source: "RapidAPI",
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

  // 🔹 Fichiers statiques
  const ext = extname(path);
  if (ext) {
    try {
      return await serveFile(req, `.${path}`);
    } catch {
      return new Response("Fichier introuvable", { status: 404 });
    }
  }

  // 🔹 Page par défaut
  try {
    return await serveFile(req, "index.html");
  } catch {
    return new Response("index.html manquant", { status: 404 });
  }
});

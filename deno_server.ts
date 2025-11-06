// 🔥 Studio Yapad Downloader v3 (Multi-Downloader 4K)
// - Compatible Instagram & TikTok
// - Hébergement 100% Deno Deploy
// - Pas besoin de clé API
// - Gère les reels, posts, et vidéos TikTok
// - Format de sortie propre, avec timestamp & source

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const { searchParams } = new URL(req.url);
  const link = searchParams.get("url");

  if (!link) {
    return new Response(JSON.stringify({ error: "Lien manquant" }), {
      headers,
      status: 400,
    });
  }

  try {
    let apiUrl = "";
    let type = "";

    // 🌐 Détection automatique de la plateforme
    if (link.includes("instagram.com")) {
      type = "instagram";
      apiUrl = `https://api.instasupersave.com/`;
    } else if (link.includes("tiktok.com")) {
      type = "tiktok";
      apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(link)}`;
    } else {
      return new Response(JSON.stringify({ error: "Plateforme non reconnue." }), {
        headers,
        status: 400,
      });
    }

    // 🚀 Appel à l'API publique correspondante
    const response = await fetch(
      type === "instagram"
        ? `${apiUrl}?url=${encodeURIComponent(link)}`
        : apiUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          "Accept": "application/json",
        },
      },
    );

    const data = await response.json();

    // 🎯 Parsing des résultats
    let mediaUrls: string[] = [];
    let author = "";
    let caption = "";

    if (type === "instagram") {
      // Pour Instasupersave : structure { media: [url], type, caption }
      if (data && data.media) {
        mediaUrls = Array.isArray(data.media) ? data.media : [data.media];
        author = data.author || "";
        caption = data.caption || "";
      }
    } else if (type === "tiktok") {
      // Pour TikWM : structure { data: { play, music, ... } }
      if (data.data) {
        mediaUrls.push(data.data.play || data.data.play_addr);
        author = data.data.author?.unique_id || "";
        caption = data.data.title || "";
      }
    }

    // ⚠️ Aucun média trouvé
    if (!mediaUrls.length) {
      return new Response(
        JSON.stringify({ error: "Aucun média détecté sur cette URL." }),
        { headers, status: 404 },
      );
    }

    // ✅ Réponse finale propre
    return new Response(
      JSON.stringify({
        source: "YapadProxy-v3",
        platform: type,
        author,
        caption,
        media: mediaUrls,
        timestamp: new Date().toISOString(),
      }),
      { headers, status: 200 },
    );
  } catch (err) {
    console.error("Erreur:", err);
    return new Response(
      JSON.stringify({
        error: "Erreur interne sur YapadProxy.",
        details: String(err),
      }),
      { headers, status: 500 },
    );
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  const { searchParams } = new URL(req.url);
  const link = searchParams.get("url");

  if (!link) {
    return new Response(JSON.stringify({ error: "Lien manquant" }), {
      headers,
      status: 400,
    });
  }

  try {
    const html = await fetch(link, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    }).then((r) => r.text());

    // 1️⃣ Vérifie la nouvelle structure Instagram (__additionalDataLoaded)
    const newJsonMatch = html.match(/window\.__additionalDataLoaded\('extra',({.*})\);<\/script>/);
    if (newJsonMatch) {
      const data = JSON.parse(newJsonMatch[1]);
      const media = data?.graphql?.shortcode_media;
      if (media) {
        const url = media.is_video
          ? media.video_url
          : media.display_resources?.pop()?.src;
        return new Response(JSON.stringify({ media: url }), {
          headers,
          status: 200,
        });
      }
    }

    // 2️⃣ Fallback ancienne structure (_sharedData)
    const oldJsonMatch = html.match(/window\._sharedData\s*=\s*(\{.*?\});<\/script>/);
    if (oldJsonMatch) {
      const data = JSON.parse(oldJsonMatch[1]);
      const media =
        data.entry_data?.PostPage?.[0]?.graphql?.shortcode_media ||
        data.entry_data?.ReelPage?.[0]?.graphql?.shortcode_media;
      if (media) {
        const url = media.is_video
          ? media.video_url
          : media.display_resources?.pop()?.src;
        return new Response(JSON.stringify({ media: url }), {
          headers,
          status: 200,
        });
      }
    }

    // 3️⃣ Aucun JSON trouvé
    return new Response(JSON.stringify({ error: "Aucun média trouvé dans la page." }), {
      headers,
      status: 404,
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Erreur serveur côté Deno." }),
      { headers, status: 500 },
    );
  }
});

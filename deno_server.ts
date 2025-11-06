import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  const { method, url } = req;

  if (method === "OPTIONS") {
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

    const match = html.match(/window\._sharedData\s*=\s*(\{.*?\});<\/script>/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Données non trouvées" }), {
        headers,
        status: 404,
      });
    }

    const data = JSON.parse(match[1]);
    const media =
      data.entry_data?.PostPage?.[0]?.graphql?.shortcode_media ||
      data.entry_data?.ReelPage?.[0]?.graphql?.shortcode_media;

    if (!media)
      return new Response(JSON.stringify({ error: "Aucun média trouvé" }), {
        headers,
        status: 404,
      });

    const mediaUrl = media.is_video
      ? media.video_url
      : media.display_resources?.pop()?.src;

    return new Response(JSON.stringify({ media: mediaUrl }), {
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Erreur interne serveur" }),
      { headers, status: 500 },
    );
  }
});

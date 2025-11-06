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

    // Tentative 1 : JSON-LD (structure standard Instagram)
    const ldMatch = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/s,
    );
    if (ldMatch) {
      const data = JSON.parse(ldMatch[1]);
      const media = data.video || data.image || null;
      if (media) {
        return new Response(
          JSON.stringify({ media: [media], type: data["@type"] }),
          { headers, status: 200 },
        );
      }
    }

    // Tentative 2 : GraphQL (structure moderne)
    const graphqlMatch = html.match(/"graphql":({.*?}),"hostname":/s);
    if (graphqlMatch) {
      const graphql = JSON.parse(graphqlMatch[1]);
      const media = graphql.shortcode_media;
      const urls: string[] = [];

      if (media.edge_sidecar_to_children) {
        for (const node of media.edge_sidecar_to_children.edges) {
          urls.push(
            node.node.is_video ? node.node.video_url : node.node.display_url,
          );
        }
      } else {
        urls.push(media.is_video ? media.video_url : media.display_url);
      }

      if (urls.length > 0) {
        return new Response(JSON.stringify({ media: urls }), {
          headers,
          status: 200,
        });
      }
    }

    // Tentative 3 : structure embed (pour les reels ou posts privés)
    const embedMatch = html.match(/"contentUrl":"(https:[^"]+)"/);
    if (embedMatch) {
      return new Response(JSON.stringify({ media: [embedMatch[1]] }), {
        headers,
        status: 200,
      });
    }

    // Aucun résultat trouvé
    console.log("⚠️ Aucun média trouvé pour", link);
    return new Response(JSON.stringify({ error: "Aucun média trouvé dans la page." }), {
      headers,
      status: 404,
    });
  } catch (err) {
    console.error("❌ Erreur serveur:", err);
    return new Response(
      JSON.stringify({ error: "Erreur interne Deno.", details: String(err) }),
      { headers, status: 500 },
    );
  }
});

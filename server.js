import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/instagram", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Aucun lien fourni" });

  try {
    const html = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
      }
    }).then(r => r.text());

    const jsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (jsonData.video) return res.json({ media: jsonData.video });
      if (jsonData.image) return res.json({ media: jsonData.image });
    }

    const graphqlMatch = html.match(/window\._sharedData\s*=\s*(\{.*?\});<\/script>/);
    if (graphqlMatch) {
      const data = JSON.parse(graphqlMatch[1]);
      const media =
        data.entry_data?.PostPage?.[0]?.graphql?.shortcode_media ||
        data.entry_data?.ReelPage?.[0]?.graphql?.shortcode_media;
      if (media) {
        const url =
          media.is_video ? media.video_url : media.display_resources?.pop()?.src;
        return res.json({ media: url });
      }
    }

    res.status(404).json({ error: "Aucun média trouvé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Backend Studio Yapad actif sur port ${PORT}`));

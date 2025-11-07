import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

/** 🔥 Proxy vers SSSInstagram */
async function proxyToSSSInstagram(instaUrl) {
  const endpoint = "https://sssinstagram.com/api/convert";

  const headers = {
    "Content-Type": "application/json",
    "Origin": "https://sssinstagram.com",
    "Referer": "https://sssinstagram.com/",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
  };

  const body = JSON.stringify({ url: instaUrl });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Réponse non JSON : ${text.slice(0, 200)}...`);
    }

    const data = await response.json();

    // Analyse du JSON retourné
    // Exemple de structure : { url: "...", links: [ {url: "..."} ], medias: [...] }
    const medias = [];

    if (Array.isArray(data.links)) {
      data.links.forEach((l) => {
        if (l.url && (l.url.includes("cdninstagram") || l.url.endsWith(".mp4")))
          medias.push(l.url);
      });
    }
    if (data.url) medias.push(data.url);
    if (data.src) medias.push(data.src);
    if (data.downloadUrl) medias.push(data.downloadUrl);

    return medias;
  } catch (err) {
    console.error("Erreur SSSInstagram:", err.message);
    return [];
  }
}

/** Route principale : /api/instagram */
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie." });

  try {
    const medias = await proxyToSSSInstagram(url);

    if (!medias.length)
      return res.json({ ok: false, error: "Aucun média trouvé sur SSSInstagram." });

    return res.json({ ok: true, medias });
  } catch (err) {
    return res.json({ ok: false, error: "Erreur serveur : " + err.message });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Downloader SSSInstagram opérationnel sur port ${PORT}`)
);

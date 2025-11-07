import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sert le front (index.html / script.js / style.css)
app.use(express.static(__dirname));

async function fetchWithUA(url, opts = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    Accept: "application/json, text/html",
    ...opts.headers,
  };
  return fetch(url, { ...opts, headers });
}

app.get("/api/instagram", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie" });

  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const r = await fetchWithUA(oembedUrl);
    const text = await r.text();

    // 🧠 si la réponse commence par < => c’est du HTML
    if (text.trim().startsWith("<")) {
      return res.json({
        ok: false,
        error: "Instagram a renvoyé une page HTML au lieu d’un JSON (API bloquée côté serveur).",
      });
    }

    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return res.json({ ok: false, error: "Réponse JSON invalide reçue d’Instagram." });
    }

    const medias = [];
    if (j.thumbnail_url) medias.push(j.thumbnail_url);
    if (j.thumbnail_url_with_play_button) medias.push(j.thumbnail_url_with_play_button);

    if (!medias.length)
      return res.json({ ok: false, error: "Aucun média détecté sur cette publication." });

    return res.json({ ok: true, medias });
  } catch (e) {
    return res.json({ ok: false, error: "Erreur API : " + e.message });
  }
});

app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("URL manquante");
  try {
    const response = await fetchWithUA(url);
    if (!response.ok)
      return res.status(500).send("Erreur lors du téléchargement (" + response.status + ")");
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "application/octet-stream"
    );
    response.body.pipe(res);
  } catch (e) {
    res.status(500).send("Erreur proxy: " + e.message);
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Studio Yapad Downloader opérationnel sur port ${PORT}`));

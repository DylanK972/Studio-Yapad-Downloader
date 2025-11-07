// server.js - Studio Yapad Downloader (Render ready)
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== Détermination du dossier courant ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== Sert le site (index.html + css + js) ======
app.use(express.static(__dirname)); // ← très important

// ====== API Instagram ======
async function fetchWithUA(url, opts = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    ...opts.headers,
  };
  return fetch(url, { ...opts, headers });
}

app.get("/api/instagram", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie" });
  try {
    // essaie via oembed
    const oembed = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const r = await fetchWithUA(oembed);
    const j = await r.json();
    const medias = [];
    if (j.thumbnail_url) medias.push(j.thumbnail_url);
    if (j.thumbnail_url_with_play_button) medias.push(j.thumbnail_url_with_play_button);
    if (!medias.length) throw new Error("Aucun média trouvé.");
    res.json({ ok: true, medias });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ====== Proxy de téléchargement ======
app.get("/proxy", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send("URL manquante");
  try {
    const response = await fetchWithUA(url);
    if (!response.ok) return res.status(500).send("Erreur lors du téléchargement");
    res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream");
    response.body.pipe(res);
  } catch (e) {
    res.status(500).send("Erreur proxy: " + e.message);
  }
});

// ====== Redirige / vers ton index.html ======
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Studio Yapad actif sur port ${PORT}`));

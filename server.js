import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 10000;

// Fix pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// =====================================================
// 🔹 Liste d’APIs gratuites / fallback Instagram
// =====================================================
const SOURCES = [
  url => `https://snapinsta.to/action.php?url=${encodeURIComponent(url)}`,
  url => `https://sssinstagram.com/api/convert?url=${encodeURIComponent(url)}`,
  url => `https://fastdl.app/action.php?url=${encodeURIComponent(url)}`,
  url => `https://indown.io/api?url=${encodeURIComponent(url)}`,
  url => `https://toolzu.com/api/v1/instagram/downloader?url=${encodeURIComponent(url)}`,
  url => `https://save-free.com/api/convert?url=${encodeURIComponent(url)}`
];


// =====================================================
// 🔹 Proxy pour contourner Render + CORS
// =====================================================
async function proxyFetch(targetUrl) {
  const proxy = "https://api.allorigins.win/get?url=";
  const r = await fetch(proxy + encodeURIComponent(targetUrl));
  const d = await r.json();
  return d.contents;
}


// =====================================================
// 🔹 Route universelle Instagram
// =====================================================
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    let html;
    for (const builder of SOURCES) {
      const target = builder(url);
      console.log("🔍 Test API:", target);
      try {
        html = await proxyFetch(target);
        if (html && html.includes("https")) {
          console.log("✅ Source OK !");
          break;
        }
      } catch (e) {
        console.log("❌ Source down:", e.message);
      }
    }

    if (!html) {
      return res.status(404).json({
        error: "Aucun média trouvé après toutes les sources."
      });
    }

    // Cherche une URL directe d’image ou vidéo
    const match = html.match(/https[^"'<>]+(jpg|jpeg|png|mp4)/);
    if (!match) {
      return res.status(400).json({ error: "Format inattendu." });
    }

    res.json({ media: match[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur interne serveur", details: err.message });
  }
});


// =====================================================
// 🔹 TikTok basique (tu pourras upgrader ensuite)
// =====================================================
app.get("/api/tiktok", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL manquante" });
  try {
    const api = `https://ssstik.io/abc?url=${encodeURIComponent(url)}`;
    const html = await proxyFetch(api);
    const match = html.match(/https[^"'<>]+(mp4)/);
    if (!match) return res.status(400).json({ error: "Aucun média TikTok trouvé." });
    res.json({ media: match[0] });
  } catch (err) {
    res.status(500).json({ error: "Erreur TikTok", details: err.message });
  }
});


// =====================================================
// 🔹 Lancement
// =====================================================
app.listen(PORT, () => {
  console.log(`✅ Studio Yapad Downloader opérationnel sur port ${PORT}`);
});

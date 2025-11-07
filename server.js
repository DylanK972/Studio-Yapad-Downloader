import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// 🧩 Utilise un proxy public pour contourner le blocage Render
async function getMedia(url) {
  const proxy = `https://r.jina.ai/http://${url.replace("https://", "")}`;
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  };
  const res = await fetch(proxy, { headers });
  const html = await res.text();

  const dom = new JSDOM(html);
  const metas = dom.window.document.querySelectorAll("meta[property]");
  const medias = [];
  metas.forEach((m) => {
    const p = m.getAttribute("property");
    const c = m.getAttribute("content");
    if (!c) return;
    if (p === "og:image" || p === "og:video") medias.push(c);
  });
  return medias;
}

// 📸 Instagram route
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie." });

  try {
    const medias = await getMedia(url);
    if (!medias.length)
      return res.json({ ok: false, error: "Aucun média trouvé." });
    res.json({ ok: true, medias });
  } catch (err) {
    res.json({ ok: false, error: "Erreur serveur : " + err.message });
  }
});

// 🎥 TikTok route (même logique)
app.get("/api/tiktok", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie." });

  try {
    const medias = await getMedia(url);
    if (!medias.length)
      return res.json({ ok: false, error: "Aucun média trouvé." });
    res.json({ ok: true, medias });
  } catch (err) {
    res.json({ ok: false, error: "Erreur serveur : " + err.message });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Studio Yapad Downloader actif sur port ${PORT}`)
);

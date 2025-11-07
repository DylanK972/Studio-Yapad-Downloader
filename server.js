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

/** Proxy universel via AllOrigins */
async function getThroughProxy(targetUrl) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
  const r = await fetch(proxy);
  const data = await r.json();
  return data.contents;
}

/** Essaie de récupérer la page Instagram directement */
async function getInstagramHTML(instaUrl) {
  try {
    const html = await getThroughProxy(instaUrl);
    return html;
  } catch (e) {
    console.error("Erreur AllOrigins:", e.message);
    return null;
  }
}

/** Analyse HTML Instagram pour trouver les liens OG:image / OG:video */
function extractMedias(html) {
  const dom = new JSDOM(html);
  const metas = dom.window.document.querySelectorAll("meta[property]");
  const medias = [];
  metas.forEach((m) => {
    const prop = m.getAttribute("property");
    const content = m.getAttribute("content");
    if (prop === "og:image" || prop === "og:video") medias.push(content);
  });
  return medias;
}

/** API principale */
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie." });

  try {
    const html = await getInstagramHTML(url);
    if (!html) return res.json({ ok: false, error: "Impossible de récupérer la page." });

    const medias = extractMedias(html);
    if (!medias.length)
      return res.json({ ok: false, error: "Aucun média trouvé." });

    return res.json({ ok: true, medias });
  } catch (e) {
    return res.json({ ok: false, error: "Erreur serveur : " + e.message });
  }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Downloader via AllOrigins actif sur port ${PORT}`)
);

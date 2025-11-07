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

/** 🧠 Téléchargement via proxy AllOrigins */
async function fetchWithProxy(url) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  const json = await res.json();
  return json.contents; // retourne le HTML original
}

/** 🔍 Analyse la page pour trouver les liens médias */
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

/** Route principale Instagram */
app.get("/api/instagram", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ ok: false, error: "Aucune URL fournie" });

  try {
    const html = await fetchWithProxy(url);
    const medias = extractMedias(html);
    if (!medias.length)
      return res.json({ ok: false, error: "Aucun média trouvé." });

    res.json({ ok: true, medias });
  } catch (e) {
    res.json({ ok: false, error: "Erreur : " + e.message });
  }
});

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "index.html"))
);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`✅ Downloader via proxy opérationnel sur port ${PORT}`)
);
